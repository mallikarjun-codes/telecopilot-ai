const Joi = require('joi');

const documentIdSchema = Joi.object({
  id: Joi.string().trim().min(1).max(100).required(),
});

const statusSchema = Joi.object({
  status: Joi.string()
    .valid('UPLOADING', 'PROCESSING', 'READY', 'FAILED')
    .required(),
});

const uploadFileSchema = Joi.object({
  originalname: Joi.string().trim().required(),
  mimetype: Joi.string().valid('application/pdf').required(),
  filename: Joi.string().required(),
  path: Joi.string().required(),
  size: Joi.number().integer().positive().max(20 * 1024 * 1024).required(),
}).unknown(true);

module.exports = {
  documentIdSchema,
  statusSchema,
  uploadFileSchema,
};
