const { ZodError } = require('zod');

function validate(schema) {
  return function validateRequest(req, res, next) {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (!(error instanceof ZodError)) {
        return next(error);
      }

      const validationError = new Error('Validation failed.');
      validationError.statusCode = 400;
      validationError.details = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return next(validationError);
    }
  };
}

module.exports = validate;
