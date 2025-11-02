class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

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
      const value = body[field.name]
      if ((value === undefined || value === null) && field.required) {
        errors.push({
          field: field.name,
          message: `${field.name} is required.`
        })
        continue
      }
      if (value === undefined || value === null) {
        data[field.name] = fieldParsers[field.type](
          (msg) => errors.push({field: field.name, message: msg}),
          field,
          value
        )
      }
  }

  if (errors.length) {
    throw new ValidationError('Invalid user payload.', errors);
  }

  return data;
};


module.exports = {
  validateUserPayload,
};

