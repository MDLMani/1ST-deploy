import cron from 'node-cron';
import { ticketRepository } from '../repositories/ticket.repository';
import { userRepository } from '../repositories/user.repository';
import { notificationService } from '../services/notification.service';
import {
  OVERDUE_THRESHOLDS_HOURS,
  SOCKET_EVENTS,
  TicketPriority,
  UserRole,
} from '../constants';
import { getSocketIO } from '../sockets';
import { cronLogger } from '../utils/logger';
import { ITicket } from '../models/Ticket.model';
import { getTicketOwnerId } from '../utils/ticket.helpers';

const isTicketOverdue = (ticket: ITicket): boolean => {
  const thresholdHours = OVERDUE_THRESHOLDS_HOURS[ticket.priority as TicketPriority];
  const createdAt = new Date(ticket.createdAt).getTime();
  const hoursElapsed = (Date.now() - createdAt) / (1000 * 60 * 60);
  return hoursElapsed >= thresholdHours;
};

export const runOverdueReminderCheck = async (): Promise<{ processed: number }> => {
  cronLogger.info('Starting overdue ticket check');

  const unresolvedTickets = await ticketRepository.findUnresolved();
  const overdueTickets = unresolvedTickets.filter(isTicketOverdue);

  if (overdueTickets.length === 0) {
    cronLogger.info('No overdue tickets found');
    return { processed: 0 };
  }

  const admins = await userRepository.findByRole(UserRole.ADMIN);
  const adminIds = admins.map((a) => a._id.toString());

  const io = getSocketIO();

  for (const ticket of overdueTickets) {
    const updated = await ticketRepository.updateById(ticket._id.toString(), {
      overdue: true,
      reminderCount: (ticket.reminderCount ?? 0) + 1,
      lastReminderAt: new Date(),
    });

    if (!updated) continue;

    cronLogger.info('Ticket marked overdue', {
      ticketNumber: updated.ticketNumber,
      priority: updated.priority,
    });

    await notificationService.notifyAdmins(
      'Overdue Ticket Alert',
      `Ticket ${updated.ticketNumber} (${updated.priority}) is overdue and requires attention.`,
      adminIds
    );

    const ownerId = getTicketOwnerId(updated);
    await notificationService.notifyUser(
      ownerId,
      'TICKET_OVERDUE',
      {
        ticketNumber: updated.ticketNumber,
        title: updated.title,
      },
      updated._id.toString()
    );

    if (io) {
      io.to('staff').emit(SOCKET_EVENTS.TICKET_OVERDUE, updated);
    }
  }

  cronLogger.info('Overdue ticket check completed', {
    processed: overdueTickets.length,
  });

  return { processed: overdueTickets.length };
};

export const startOverdueReminderJob = (): void => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      await runOverdueReminderCheck();
    } catch (error) {
      cronLogger.error('Overdue ticket job failed', { error });
    }
  });

  cronLogger.info('Overdue reminder cron job scheduled (every hour)');
};
