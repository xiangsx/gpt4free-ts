import { Context, Next } from 'koa';
import Joi, { ValidationOptions } from 'joi';
import { ComError } from './index';

export const checkBody = (
  schema: {
    [key: string]: Joi.Schema;
  },
  options?: {} & ValidationOptions,
) => {
  return async (ctx: Context, next: Next) => {
    const { body } = ctx.request;
    const { error } = Joi.object(schema).validate(body, options);
    if (error) {
      throw new ComError(error.message, ComError.Status.ParamsError);
    }
    await next();
  };
};

export const checkQuery = (
  schema: {
    [key: string]: Joi.Schema;
  },
  options?: {} & ValidationOptions,
) => {
  return async (ctx: Context, next: Next) => {
    const { query } = ctx.request;
    const { error } = Joi.object(schema).validate(query, options);
    if (error) {
      throw new ComError(error.message, ComError.Status.ParamsError);
    }
    await next();
  };
};
