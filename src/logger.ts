import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import chalk from 'chalk';

const { combine, timestamp, printf, colorize } = format;
// Define a custom log format

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

// Function to create a logger for a specific market
export const makeLogger = (name: string, color: chalk.Chalk) => createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf(({ level, message, timestamp }) => {
            // Apply the color function to the log level and message
            return `${color(`[${timestamp}] ${level.toUpperCase()}: ${message}`)}`;
        })
    ),
    transports: [
        // Log to the console
        // new transports.Console({
        //     format: combine(
        //         colorize({
        //             all: true
        //         }),
        //         logFormat
        //     )
        // }),
        new transports.Console(),
        // Log to a file with rotation
        new DailyRotateFile({
            filename: `logs/${name}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxFiles: '7d', // Keep logs for 7 days
            maxSize: '100m',
            zippedArchive: true,
            format: logFormat
        })
    ],
});