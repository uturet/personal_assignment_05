const { ObjectId } = require('mongodb');
const mongodb = require('../db');
const { ValidationError } = require('../utils/errors');

const EVENTS_COLLECTION = 'events';
const VISIBILITY_OPTIONS = new Set(['public', 'subscribers', 'private']);

const getCollection = () => mongodb.getDb().collection(EVENTS_COLLECTION);

const ensurePlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const buildEventDocument = (payload) => {
  const body = ensurePlainObject(payload);

  if (!body) {
    throw createFieldError('body', 'Request body must be a JSON object.');
  }

  const document = {};

  document.ownerID = parseOwnerId(body.ownerID);

  const visibility = parseStringField(body.visibility, 'visibility');
  if (!VISIBILITY_OPTIONS.has(visibility)) {
    throw createFieldError(
      'visibility',
      "visibility must be one of: 'public', 'subscribers', or 'private'.",
    );
  }
  document.visibility = visibility;

  document.googlePoint = parseStringField(body.googlePoint, 'googlePoint');
  document.description = parseStringField(body.description, 'description');
  document.datetime_start = parseDateField(body.datetime_start, 'datetime_start');
  document.datetime_end = parseDateField(body.datetime_end, 'datetime_end');
  document.period = parseDateField(body.period, 'period');
  document.repeatUntil = parseDateField(body.repeatUntil, 'repeatUntil');

  if (document.datetime_end < document.datetime_start) {
    throw createFieldError(
      'datetime_end',
      'datetime_end must be greater than datetime_start.',
    );
  }

  if (document.repeatUntil < document.datetime_start) {
    throw createFieldError(
      'repeatUntil',
      'repeatUntil must be greater than datetime_start.',
    );
  }

  if (document.repeatUntil < document.datetime_end) {
    throw createFieldError(
      'repeatUntil',
      'repeatUntil must be on or after datetime_end.',
    );
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
  try {
    const events = await getCollection().find().toArray();
    return res.status(200).json(events.map(formatEvent));
  } catch (error) {
    console.error('Failed to fetch events', error);
    return res.status(500).json({ message: 'Failed to fetch events.' });
  }
};

exports.getEvent = async (req, res) => {
  /*
    #swagger.description = 'Get one event by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event id format.' });
  }

  try {
    const event = await getCollection().findOne({
      _id: ObjectId.createFromHexString(id),
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    return res.status(200).json(formatEvent(event));
  } catch (error) {
    console.error(`Failed to fetch event ${id}`, error);
    return res.status(500).json({ message: 'Failed to fetch event.' });
  }
};

exports.createEvent = async (req, res) => {
  /*
    #swagger.description = 'Create new event'
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            required: [
              'ownerID',
              'visibility',
              'description',
              'datetime_start',
              'datetime_end'
            ],
            properties: {
              ownerID: {
                type: 'string',
                pattern: '^[0-9a-fA-F]{24}$'
              },
              visibility: {
                type: 'string',
                enum: ['public', 'subscribers', 'private']
              },
              googlePoint: { type: 'string' },
              description: { type: 'string' },
              datetime_start: { type: 'string', format: 'date-time' },
              datetime_end: { type: 'string', format: 'date-time' },
              period: { type: 'string', format: 'date-time' },
              repeatUntil: { type: 'string', format: 'date-time' }
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
        name: "ownerID",
        type: "ownerId",
        required: true,
      },
      {
        name: "visibility",
        type: "options",
        required: true,
        options: VISIBILITY_OPTIONS
      },
      {
        name: "googlePoint",
        type: "string",
      },
      {
        name: "description",
        type: "string",
        required: true,
      },
      {
        name: "datetime_start",
        type: "date",
        required: true,
      },
      {
        name: "datetime_end",
        type: "date",
        required: true,
      },
      {
        name: "period",
        type: "date",
      },
      {
        name: "repeatUntil",
        type: "date",
      },
    ]);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, details: error.details });
    }

    console.error('Unexpected validation error while creating event', error);
    return res.status(500).json({ message: 'Failed to validate event payload.' });
  }

  try {
    const result = await getCollection().insertOne(payload);
    return res.status(201).json({ id: result.insertedId.toString() });
  } catch (error) {
    console.error('Error creating event', error);
    return res.status(500).json({ message: 'Failed to create event.' });
  }
};

exports.updateEvent = async (req, res) => {
  /*
    #swagger.description = 'Update an event by id'
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: 'object',
            properties: {
              visibility: {
                type: 'string',
                enum: ['public', 'subscribers', 'private']
              },
              googlePoint: { type: 'string' },
              description: { type: 'string' },
              datetime_start: { type: 'string', format: 'date-time' },
              datetime_end: { type: 'string', format: 'date-time' },
              period: { type: 'string', format: 'date-time' },
              repeatUntil: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event id format.' });
  }

  let payload;

  try {
    payload = validateUserPayload(req.body, [
      {
        name: "visibility",
        type: "options",
        options: VISIBILITY_OPTIONS
      },
      {
        name: "googlePoint",
        type: "string",
      },
      {
        name: "description",
        type: "string",
      },
      {
        name: "datetime_start",
        type: "date",
      },
      {
        name: "datetime_end",
        type: "date",
      },
      {
        name: "period",
        type: "date",
      },
      {
        name: "repeatUntil",
        type: "date",
      },
    ]);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, details: error.details });
    }

    console.error('Unexpected validation error while updating event', error);
    return res.status(500).json({ message: 'Failed to validate event payload.' });
  }

  if (!Object.keys(payload).length) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }

  try {
    const result = await getCollection().updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { $set: payload },
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(`Error updating event ${id}`, error);
    return res.status(500).json({ message: 'Failed to update event.' });
  }
};

exports.deleteEvent = async (req, res) => {
  /*
    #swagger.description = 'Delete event by id'
  */
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid event id format.' });
  }

  try {
    const result = await getCollection().deleteOne({
      _id: ObjectId.createFromHexString(id),
    });

    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(`Error deleting event ${id}`, error);
    return res.status(500).json({ message: 'Failed to delete event.' });
  }
};
