const { ObjectId } = require('mongodb');
const mongodb = require('../db');

const EVENTS_COLLECTION = 'events';
const VISIBILITY_OPTIONS = new Set(['public', 'subscribers', 'private']);

const getCollection = () => mongodb.getDb().collection(EVENTS_COLLECTION);

const parseDateField = (value, fieldName) => {
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
};

const parseStringField = (value, fieldName) => {
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }
  
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
};

const buildEventDocument = (payload) => {
  const document = {};

  document.ownerID = parseStringField(payload.ownerID, 'ownerID');

  const visibility = parseStringField(payload.visibility, 'visibility');
  if (!VISIBILITY_OPTIONS.has(visibility)) {
    throw new Error(
      "visibility must be one of: 'public', 'subscribers', or 'private'.",
    );
  }
  document.visibility = visibility;

  document.googlePoint = parseStringField(payload.googlePoint, 'googlePoint');
  document.description = parseStringField(payload.description, 'description');
  document.datetime_start = parseDateField(payload.datetime_start, 'datetime_start');
  document.datetime_end = parseDateField(payload.datetime_end, 'datetime_end');
  document.period = parseDateField(payload.period, 'period');
  document.repeatUntil = parseDateField(payload.repeatUntil, 'repeatUntil', );

  if (document.datetime_end < document.datetime_start) {
    throw new Error('datetime_end must be greater than datetime_start.');
  }

  if (document.repeatUntil < document.datetime_start) {
    throw new Error('repeatUntil must be greater than datetime_start.');
  }

  return document;
};

const formatEvent = (doc) => ({
  id: doc._id.toString(),
  ownerID: doc.ownerID,
  visibility: doc.visibility,
  googlePoint: doc.googlePoint,
  description: doc.description,
  datetime_start: doc.datetime_start.toISOString(),
  datetime_end: doc.datetime_end.toISOString(),
  period: doc.period.toISOString(),
  repeatUntil: doc.repeatUntil.toISOString(),
});

exports.getEvents = async (_, res) => {
  /*
    #swagger.description = 'Get all events'
  */
  const events = await getCollection().find().toArray();
  res.status(200).json(events.map(formatEvent));
};

exports.getEvent = async (req, res) => {
  /*
    #swagger.description = 'Get one event by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event id format.' });
  }

  const event = await getCollection().findOne({
    _id: ObjectId.createFromHexString(id),
  });

  if (!event) {
    return res.status(404).json({ message: 'Event not found.' });
  }

  res.status(200).json(formatEvent(event));
};

exports.createEvent = async (req, res) => {
  /*
    #swagger.description = 'Create new event'
  */
  let eventDocument;

  try {
    eventDocument = buildEventDocument(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const result = await getCollection().insertOne(eventDocument);
  res.status(201).json({ id: result.insertedId.toString() });
};

exports.updateEvent = async (req, res) => {
  /*
    #swagger.description = 'Update an event by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event id format.' });
  }

  let updateFields;

  try {
    updateFields = buildEventDocument(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  if (!Object.keys(updateFields).length) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }

  const result = await getCollection().updateOne(
    { _id: ObjectId.createFromHexString(id) },
    { $set: updateFields },
  );

  if (!result.matchedCount) {
    return res.status(404).json({ message: 'Event not found.' });
  }

  res.status(204).send();
};

exports.deleteEvent = async (req, res) => {
  /*
    #swagger.description = 'Delete event by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event id format.' });
  }

  const result = await getCollection().deleteOne({
    _id: ObjectId.createFromHexString(id),
  });

  if (!result.deletedCount) {
    return res.status(404).json({ message: 'Event not found.' });
  }

  res.status(204).send();
};
