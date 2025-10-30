const { ObjectId } = require('mongodb');
const mongodb = require('../db');
const { ValidationError } = require('../utils/errors');

const USERS_COLLECTION = 'users';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCollection = () => mongodb.getDb().collection(USERS_COLLECTION);

const ensurePlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const toHexString = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  return typeof value === 'string' ? value : value.toHexString();
};

const formatUser = (doc) => ({
  id: toHexString(doc._id),
  first_name: doc.first_name,
  last_name: doc.last_name,
  email: doc.email,
  subscribet_to: Array.isArray(doc.subscribet_to)
    ? doc.subscribet_to.map((subscriptionId) => toHexString(subscriptionId))
    : [],
});

const validateUserPayload = (payload, { requireAllFields = false } = {}) => {
  const body = ensurePlainObject(payload);

  if (!body) {
    throw new ValidationError('Invalid user payload.', [
      {
        field: 'body',
        message: 'Request body must be a JSON object.',
      },
    ]);
  }

  const sanitized = {};
  const errors = [];

  const collectStringField = (field) => {
    const value = body[field];

    if (value === undefined || value === null) {
      if (requireAllFields) {
        errors.push({
          field,
          message: `${field} is required.`,
        });
      }
      return;
    }

    if (typeof value !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string.`,
      });
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      errors.push({
        field,
        message: `${field} must be a non-empty string.`,
      });
      return;
    }

    sanitized[field] = trimmed;
  };

  collectStringField('first_name');
  collectStringField('last_name');
  collectStringField('email');

  if (sanitized.email && !EMAIL_REGEX.test(sanitized.email)) {
    errors.push({
      field: 'email',
      message: 'email must be a valid email address.',
    });
  }

  if (body.subscribet_to !== undefined) {
    if (!Array.isArray(body.subscribet_to)) {
      errors.push({
        field: 'subscribet_to',
        message: 'subscribet_to must be an array.',
      });
    } else {
      const cleaned = [];
      body.subscribet_to.forEach((value, index) => {
        if (typeof value !== 'string') {
          errors.push({
            field: `subscribet_to[${index}]`,
            message: 'Each entry must be a string.',
          });
          return;
        }

        const trimmed = value.trim();
        if (!trimmed) {
          errors.push({
            field: `subscribet_to[${index}]`,
            message: 'Entries cannot be empty strings.',
          });
          return;
        }

        if (!ObjectId.isValid(trimmed)) {
          errors.push({
            field: `subscribet_to[${index}]`,
            message: 'Each entry must be a valid Mongo ObjectId string.',
          });
          return;
        }

        cleaned.push(trimmed);
      });

      sanitized.subscribet_to = [...new Set(cleaned)];
    }
  } else if (requireAllFields) {
    sanitized.subscribet_to = [];
  }

  if (errors.length) {
    throw new ValidationError('Invalid user payload.', errors);
  }

  if (!Object.keys(sanitized).length && !requireAllFields) {
    throw new ValidationError('No valid user fields provided for update.');
  }

  return sanitized;
};

const mapSubscriptionsToObjectIds = (subscriptionIds = []) =>
  subscriptionIds.map((id) => ObjectId.createFromHexString(id));

exports.getUser = async (req, res) => {
  /*
    #swagger.description = 'Get one user by id'
  */
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  try {
    const user = await getCollection().findOne({
      _id: ObjectId.createFromHexString(id),
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json(formatUser(user));
  } catch (error) {
    console.error(`Failed to fetch user ${id}`, error);
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
};

exports.createUser = async (req, res) => {
  /*
    #swagger.description = 'Create new user'
  */
  let payload;

  try {
    payload = validateUserPayload(req.body, { requireAllFields: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, details: error.details });
    }

    console.error('Unexpected validation error while creating user', error);
    return res.status(500).json({ message: 'Failed to validate user payload.' });
  }

  try {
    const collection = getCollection();
    const existing = await collection.findOne({ email: payload.email });
    if (existing) {
      return res.status(409).json({ message: 'A user with that email already exists.' });
    }

    const userDocument = {
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      subscribet_to: mapSubscriptionsToObjectIds(payload.subscribet_to),
    };

    const result = await collection.insertOne(userDocument);
    return res.status(201).json({ id: result.insertedId.toString() });
  } catch (error) {
    console.error('Error creating user', error);
    return res.status(500).json({ message: 'Failed to create user.' });
  }
};

exports.updateUser = async (req, res) => {
  /*
    #swagger.description = 'Update a user by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  let payload;

  try {
    payload = validateUserPayload(req.body, { requireAllFields: false });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, details: error.details });
    }

    console.error('Unexpected validation error while updating user', error);
    return res.status(500).json({ message: 'Failed to validate user payload.' });
  }

  const updateDocument = {};

  if (payload.first_name !== undefined) {
    updateDocument.first_name = payload.first_name;
  }
  if (payload.last_name !== undefined) {
    updateDocument.last_name = payload.last_name;
  }
  if (payload.email !== undefined) {
    updateDocument.email = payload.email;
  }
  if (payload.subscribet_to !== undefined) {
    updateDocument.subscribet_to = mapSubscriptionsToObjectIds(payload.subscribet_to);
  }

  try {
    const collection = getCollection();

    if (updateDocument.email) {
      const existing = await collection.findOne({
        email: updateDocument.email,
        _id: { $ne: ObjectId.createFromHexString(id) },
      });

      if (existing) {
        return res.status(409).json({ message: 'A user with that email already exists.' });
      }
    }

    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { $set: updateDocument },
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(`Error updating user ${id}`, error);
    return res.status(500).json({ message: 'Failed to update user.' });
  }
};

exports.deleteUser = async (req, res) => {
  /*
    #swagger.description = 'Delete user by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  try {
    const result = await getCollection().deleteOne({
      _id: ObjectId.createFromHexString(id),
    });

    if (!result.deletedCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(`Error deleting user ${id}`, error);
    return res.status(500).json({ message: 'Failed to delete user.' });
  }
};
