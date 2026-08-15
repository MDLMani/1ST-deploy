import { Types } from 'mongoose';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/** Mongoose ObjectId.isValid is too loose historically — require 24 hex chars. */
export function isStrictObjectId(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_RE.test(value.trim());
}

export function toObjectIds(values: string[] | undefined): Types.ObjectId[] {
  if (!values?.length) return [];
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => isStrictObjectId(value))
    .map((value) => new Types.ObjectId(value));
}
