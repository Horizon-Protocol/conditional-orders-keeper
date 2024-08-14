import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';


const { combine, timestamp, printf, colorize } = format;
// Define a custom log format
const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

// Function to create a logger for a specific market
export const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        // Log to the console
        new transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        }),
        // Log to a file with rotation
        new DailyRotateFile({
            filename: `logs/application-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxFiles: '60d', // Keep logs for 60 days (2 months)
            zippedArchive: true,
            format: logFormat
        })
    ],
});