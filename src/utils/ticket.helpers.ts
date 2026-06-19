import { Types } from 'mongoose';
import { ITicket } from '../models/Ticket.model';

export const getTicketOwnerId = (ticket: ITicket): string => {
  const user = ticket.user;

  if (user instanceof Types.ObjectId) {
    return user.toString();
  }

  if (typeof user === 'object' && user !== null && '_id' in user) {
    return (user as { _id: Types.ObjectId })._id.toString();
  }

  return String(user);
};
