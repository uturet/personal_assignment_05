const { ObjectId } = require('mongodb');
const mongodb = require('../db');

const USERS_COLLECTION = 'users';

const getCollection = () => mongodb.getDb().collection(USERS_COLLECTION);

const formatUser = (doc) => ({
  id: doc._id.toString(),
  first_name: doc.first_name,
  last_name: doc.last_name,
  email: doc.email,
  subscribet_to: doc.subscribet_to,
});

exports.getUser = async (req, res) => {
  /*
    #swagger.description = 'Get one user by id'
  */
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  const user = await getCollection().findOne({
    _id: ObjectId.createFromHexString(id),
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json(formatUser(user));
};

exports.createUser = async (req, res) => {
  /*
    #swagger.description = 'Create new user'
  */
  const { first_name, last_name, email, subscribet_to } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({
      message:
        'first_name, last_name, email are required to create a user.',
    });
  }

  const existing = await getCollection().findOne({ email });
  if (existing) {
    return res.status(409).json({ message: 'A user with that email already exists.' });
  }

  const userDocument = {
    first_name,
    last_name,
    email,
    subscribet_to: [],
  };

  const result = await getCollection().insertOne(userDocument);
  res.status(201).json({ id: result.insertedId.toString() });
};

exports.updateUser = async (req, res) => {
  /*
    #swagger.description = 'Update a user by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  const {
    first_name,
    last_name,
    email,
  } = req.body ?? {};

  const updateFields = {};

  if (first_name !== undefined) {
    updateFields.first_name = first_name;
  }
  if (last_name !== undefined) {
    updateFields.last_name = last_name;
  }
  if (email !== undefined) {
    updateFields.email = email;
  }

  if (!Object.keys(updateFields).length) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }

  const result = await getCollection().updateOne(
    { _id: ObjectId.createFromHexString(id) },
    { $set: updateFields },
  );

  if (!result.matchedCount) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(204).send();
};

exports.deleteUser = async (req, res) => {
  /*
    #swagger.description = 'Delete user by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user id format.' });
  }

  const result = await getCollection().deleteOne({
    _id: ObjectId.createFromHexString(id),
  });

  if (!result.deletedCount) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(204).send();
};
