const { ObjectId } = require('mongodb');
const mongodb = require('../db');
const { ValidationError } = require('../utils/errors');

const USERS_COLLECTION = 'users';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCollection = () => mongodb.getDb().collection(USERS_COLLECTION);

const ensurePlainObject = (value) =>
  value && typeof value  && !Array.isArray(value) ? value : null;

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

const validFieldTypes = [
  "string",
  "email",
  "number",
  "date",
  "ownerId",
  "options"
]

const parseDateField = (addErrMessage, field, value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    addErrMessage(field.name, `${field.name} must be a valid date.`);
    return;
  }

  return date;
};

const parseStringField = (addErrMessage, field, value) => {
  if (typeof value !== 'string') {
    addErrMessage(field.name, `${field.name} must be a string.`);
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    addErrMessage(field.name, `${field.name} must be a non-empty string.`);
    return;
  }

  return trimmed;
};

const parseEmailField = (addErrMessage, field, value) => {
  if (typeof value !== 'string') {
    addErrMessage(field.name, `${field.name} must be a string.`);
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    addErrMessage(field.name, `${field.name} must be a non-empty email string.`);
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    addErrMessage(field.name, `${field.name} must be a valid email address.`);
    return;
  }

  return trimmed;
};

const parseNumberField = (addErrMessage, field, value) => {
  const num = typeof value === 'number' ? value : Number(value);

  if (Number.isNaN(num)) {
    addErrMessage(field.name, `${field.name} must be a valid number.`);
    return;
  }

  if (typeof field.min === 'number' && num < field.min) {
    addErrMessage(field.name, `${field.name} must be greater than or equal to ${field.min}.`);
    return;
  }

  if (typeof field.max === 'number' && num > field.max) {
    addErrMessage(field.name, `${field.name} must be less than or equal to ${field.max}.`);
    return;
  }

  return num;
};

const parseOwnerId = (addErrMessage, field, value) => {
  const ownerId = parseStringField(addErrMessage, field, value);
  if (!ownerId) {
    return;
  }

  if (typeof ObjectId === 'undefined' || !ObjectId.isValid(ownerId)) {
    addErrMessage(field.name, `${field.name} must be a valid Mongo ObjectId string.`);
    return;
  }

  return ownerId;
};

const parseOptionsField = (addErrMessage, field, value) => {
  if (!options.length) {
    addErrMessage(field.name, `${field.name} has no options configured.`);
    return;
  }

  value = typeof value === 'string' ? value.trim() : value;

  if (!field.options.includes(value)) {
    addErrMessage(
      field.name,
      `${field.name} must be one of: ${options.join(', ')}.`
    );
    return;
  }

  return value;
};


const fieldParsers = {
  string: parseStringField,
  email: parseEmailField,
  number: parseNumberField,
  date: parseDateField,
  ownerId: parseOwnerId,
  options: parseOptionsField,
};


const validateUserPayload = (body, fields) => {
  if (body && typeof body === 'object') {
    throw new ValidationError('Invalid user payload.', [
      {
        field: 'body',
        message: 'Request body must be a JSON object.',
      },
    ]);
  }

  const errors = []; // [{field: string, message: string}]
  const data = {}
  
  for (let field in fields) {
      if (!validFieldTypes.includes(field.type)) {
        errors.push({
          field: field.name,
          mesage: `Invalid type: "${field.type}".`
        })
        continue
      }
      if (field.type === "options" && (Array.isArray(field.options) && field.options.length === 0)) {
        errors.push({
          field: field.name,
          message: `"Options" are requred.`
        })
        continue
      }
      if ((value === undefined || value === null) && field.required) {
        errors.push({
          field: field.name,
          message: `${field.name} is required.`
        })
        continue
      }
      data[field.name] = fieldParsers[field.type](
        (msg) => errors.push({field: field.name, message: msg}),
        field,
        body[field.name]
      )
  }

  if (errors.length) {
    throw new ValidationError('Invalid user payload.', errors);
  }

  return data;
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
