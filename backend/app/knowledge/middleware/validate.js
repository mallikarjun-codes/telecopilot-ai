function createValidationError(details) {
  const error = new Error('Validation failed.');
  error.statusCode = 400;
  error.details = details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message,
  }));
  return error;
}

function validate(source, schema) {
  return function validateRequest(req, res, next) {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(createValidationError(error.details));
    }

    req[source] = value;
    return next();
  };
}

function validateFile(schema) {
  return function validateUploadedFile(req, res, next) {
    if (!req.file) {
      return next(createValidationError([{
        path: ['file'],
        message: 'A PDF file is required.',
      }]));
    }

    const { error } = schema.validate(req.file, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (error) {
      return next(createValidationError(error.details));
    }

    return next();
  };
}

module.exports = {
  validate,
  validateFile,
};
