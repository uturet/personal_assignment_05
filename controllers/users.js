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
  firstName: doc.firstName,
  lastName: doc.lastName,
  avatar: doc.avatar,
  email: doc.email,
  subscribetTo: Array.isArray(doc.subscribetTo)
    ? doc.subscribetTo.map((subscriptionId) => toHexString(subscriptionId))
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
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              avatar: { type: 'string' },
              email: { type: 'string', format: 'email' },
              subscribetTo: {
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
  if (id !== req.user.id) {
    return res.status(401).json({ message: 'Unaothorized.' });
  }

  let payload;

  try {
    payload = validateUserPayload(req.body, [
      {
        name: "firstName",
        type: "string",
      },
      {
        name: "lastName",
        type: "string",
      },
      {
        name: "avatar",
        type: "string",
      },
      {
        name: "email",
        type: "email",
      },
      {
        name: "subscribetTo",
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

  if (payload.firstName !== undefined) {
    updateDocument.firstName = payload.firstName;
  }
  if (payload.lastName !== undefined) {
    updateDocument.lastName = payload.lastName;
  }
  if (payload.avatar !== undefined) {
    updateDocument.avatar = payload.avatar;
  }
  if (payload.email !== undefined) {
    updateDocument.email = payload.email;
  }
  if (payload.subscribetTo !== undefined) {
    updateDocument.subscribetTo = mapSubscriptionsToObjectIds(payload.subscribetTo);
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
