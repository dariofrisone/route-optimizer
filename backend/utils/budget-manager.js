const db = require('../config/database');

class BudgetManager {
    constructor() {
        this.dailyLimit = parseInt(process.env.TOMTOM_DAILY_LIMIT) || 2500;
        this.hourlyLimit = parseInt(process.env.TOMTOM_HOURLY_LIMIT) || 104;

        // Budget allocation percentages
        this.allocation = {
            active: parseFloat(process.env.BUDGET_ALLOCATION_ACTIVE) || 0.40,
            prefetch: parseFloat(process.env.BUDGET_ALLOCATION_PREFETCH) || 0.24,
            refresh: parseFloat(process.env.BUDGET_ALLOCATION_REFRESH) || 0.28,
            buffer: parseFloat(process.env.BUDGET_ALLOCATION_BUFFER) || 0.08
        };
    }

    /**
     * Check if we can make a request within budget
     * @param {string} budgetType - active, prefetch, refresh, or buffer
     * @param {number} requestCount - Number of requests to make
     * @returns {Promise<{allowed: boolean, remaining: number, message: string}>}
     */
    async canMakeRequest(budgetType = 'active', requestCount = 1) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const hour = now.getHours();

        try {
            // Check daily usage
            const dailyUsageQuery = `
                SELECT COALESCE(SUM(request_count), 0) as total
                FROM api_usage
                WHERE api_name = 'tomtom' AND date = $1
            `;
            const dailyResult = await db.query(dailyUsageQuery, [date]);
            const dailyUsed = parseInt(dailyResult.rows[0].total);

            // Check hourly usage
            const hourlyUsageQuery = `
                SELECT COALESCE(SUM(request_count), 0) as total
                FROM api_usage
                WHERE api_name = 'tomtom' AND date = $1 AND hour = $2
            `;
            const hourlyResult = await db.query(hourlyUsageQuery, [date, hour]);
            const hourlyUsed = parseInt(hourlyResult.rows[0].total);

            // Calculate remaining budget
            const dailyRemaining = this.dailyLimit - dailyUsed;
            const hourlyRemaining = this.hourlyLimit - hourlyUsed;

            // Check budget type allocation
            const typeLimit = Math.floor(this.dailyLimit * this.allocation[budgetType]);
            const typeUsageQuery = `
                SELECT COALESCE(SUM(request_count), 0) as total
                FROM api_usage
                WHERE api_name = 'tomtom' AND date = $1 AND budget_type = $2
            `;
            const typeResult = await db.query(typeUsageQuery, [date, budgetType]);
            const typeUsed = parseInt(typeResult.rows[0].total);
            const typeRemaining = typeLimit - typeUsed;

            // Determine if request is allowed
            const allowed = dailyRemaining >= requestCount &&
                          hourlyRemaining >= requestCount &&
                          typeRemaining >= requestCount;

            let message = '';
            if (!allowed) {
                if (dailyRemaining < requestCount) {
                    message = `Daily limit reached (${dailyUsed}/${this.dailyLimit})`;
                } else if (hourlyRemaining < requestCount) {
                    message = `Hourly limit reached (${hourlyUsed}/${this.hourlyLimit})`;
                } else if (typeRemaining < requestCount) {
                    message = `Budget type '${budgetType}' limit reached (${typeUsed}/${typeLimit})`;
                }
            }

            return {
                allowed,
                remaining: Math.min(dailyRemaining, hourlyRemaining, typeRemaining),
                dailyUsed,
                hourlyUsed,
                typeUsed,
                message
            };

        } catch (error) {
            console.error('Budget check error:', error);
            // Fail open but log the error
            return {
                allowed: true,
                remaining: 0,
                message: 'Budget check failed, allowing request'
            };
        }
    }

    /**
     * Record API request usage
     * @param {string} budgetType - active, prefetch, refresh, or buffer
     * @param {number} requestCount - Number of requests made
     */
    async recordUsage(budgetType = 'active', requestCount = 1) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const hour = now.getHours();

        try {
            const query = `
                INSERT INTO api_usage (api_name, date, hour, request_count, budget_type)
                VALUES ('tomtom', $1, $2, $3, $4)
                ON CONFLICT (api_name, date, hour, budget_type)
                DO UPDATE SET request_count = api_usage.request_count + $3
            `;
            await db.query(query, [date, hour, requestCount, budgetType]);

            console.log(`📊 Recorded ${requestCount} TomTom request(s) [${budgetType}] at ${hour}:00`);

        } catch (error) {
            console.error('Failed to record API usage:', error);
        }
    }

    /**
     * Get usage statistics for today
     */
    async getTodayStats() {
        const date = new Date().toISOString().split('T')[0];

        try {
            const query = `
                SELECT
                    budget_type,
                    SUM(request_count) as total,
                    array_agg(hour ORDER BY hour) as hours,
                    array_agg(request_count ORDER BY hour) as counts
                FROM api_usage
                WHERE api_name = 'tomtom' AND date = $1
                GROUP BY budget_type
            `;
            const result = await db.query(query, [date]);

            const totalQuery = `
                SELECT COALESCE(SUM(request_count), 0) as total
                FROM api_usage
                WHERE api_name = 'tomtom' AND date = $1
            `;
            const totalResult = await db.query(totalQuery, [date]);
            const totalUsed = parseInt(totalResult.rows[0].total);

            return {
                date,
                totalUsed,
                remaining: this.dailyLimit - totalUsed,
                percentUsed: ((totalUsed / this.dailyLimit) * 100).toFixed(1),
                byType: result.rows,
                dailyLimit: this.dailyLimit
            };

        } catch (error) {
            console.error('Failed to get usage stats:', error);
            return null;
        }
    }

    /**
     * Get optimal time to make prefetch requests (off-peak hours)
     */
    isOffPeakHour() {
        const hour = new Date().getHours();
        // Off-peak: midnight to 6am
        return hour >= 0 && hour < 6;
    }

    /**
     * Reset daily counters (called by cron job at midnight)
     */
    async resetDailyCounters() {
        console.log('🔄 Resetting daily API budget counters');
        const stats = await this.getTodayStats();
        if (stats) {
            console.log(`Yesterday's usage: ${stats.totalUsed}/${stats.dailyLimit} (${stats.percentUsed}%)`);
        }
    }
}

module.exports = new BudgetManager();
