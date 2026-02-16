const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatMessage(level, message, data = null) {
        const timestamp = this.getTimestamp();
        let logMessage = `[${timestamp}] [${level}] ${message}`;

        if (data) {
            logMessage += `\n${JSON.stringify(data, null, 2)}`;
        }

        return logMessage;
    }

    writeToFile(filename, message) {
        const logFile = path.join(this.logDir, filename);
        fs.appendFileSync(logFile, message + '\n', 'utf8');
    }

    info(message, data = null) {
        const formattedMessage = this.formatMessage('INFO', message, data);
        console.log(formattedMessage);
        this.writeToFile('app.log', formattedMessage);
    }

    error(message, error = null) {
        const errorData = error ? {
            message: error.message,
            stack: error.stack,
            ...error
        } : null;

        const formattedMessage = this.formatMessage('ERROR', message, errorData);
        console.error(formattedMessage);
        this.writeToFile('error.log', formattedMessage);
    }

    warn(message, data = null) {
        const formattedMessage = this.formatMessage('WARN', message, data);
        console.warn(formattedMessage);
        this.writeToFile('app.log', formattedMessage);
    }

    debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            const formattedMessage = this.formatMessage('DEBUG', message, data);
            console.log(formattedMessage);
            this.writeToFile('debug.log', formattedMessage);
        }
    }

    traffic(message, data = null) {
        const formattedMessage = this.formatMessage('TRAFFIC', message, data);
        console.log(formattedMessage);
        this.writeToFile('traffic.log', formattedMessage);
    }

    optimization(message, data = null) {
        const formattedMessage = this.formatMessage('OPTIMIZATION', message, data);
        console.log(formattedMessage);
        this.writeToFile('optimization.log', formattedMessage);
    }
}

module.exports = new Logger();
