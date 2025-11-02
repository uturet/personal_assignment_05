const { ObjectId } = require('mongodb');
const mongodb = require('../db');
const { validateUserPayload, ValidationError } = require('../utils/errors');

const USERS_COLLECTION = 'users';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCollection = () => mongodb.getDb().collection(USERS_COLLECTION);

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
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: ['first_name', 'last_name', 'email', 'subscribet_to'],
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              subscribet_to: {
                type: 'array',
                items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }
              }
            }
          }
        }
      }
    }
  */
  let payload;

  try {
    payload = validateUserPayload(req.body, [
      {
        name: "first_name",
        type: "string",
        required: true,
      },
      {
        name: "last_name",
        type: "string",
        required: true,
      },
      {
        name: "email",
        type: "email",
        required: true,
      },
      {
        name: "subscribet_to",
        type: "ownerId",
        required: true,
      },
    ]);
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
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              subscribet_to: {
                type: 'array',
                items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }
              }
            }
          }
        }
      }
    }
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  let payload;

  try {
    payload = validateUserPayload(req.body, [
      {
        name: "first_name",
        type: "string",
      },
      {
        name: "last_name",
        type: "string",
      },
      {
        name: "email",
        type: "email",
      },
      {
        name: "subscribet_to",
        type: "ownerId",
      },
    ]);
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
