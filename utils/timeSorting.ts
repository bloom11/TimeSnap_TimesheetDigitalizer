import { TimeEntry } from '../types';

/**
 * Automatically sorts the time values (entrance, lunchStart, lunchEnd, exit)
 * horizontally per row, ensuring they are in chronological order.
 * This fixes cases where human error on the physical timesheet (e.g. entrance written
 * in the exit column) causes false chronological data after scanning.
 */
export const autoSortTimeColumns = (entries: TimeEntry[]): TimeEntry[] => {
    return entries.map(entry => {
        // Collect times from standard keys
        const timeKeys: (keyof TimeEntry)[] = ['entrance', 'lunchStart', 'lunchEnd', 'exit'];
        
        const validTimeRegex = /^(\d{1,2}):(\d{2})$/;
        
        type ValidTime = {
            timeStr: string;
            minutes: number;
        };
        
        const validTimesFound: ValidTime[] = [];
        const originalKeysWithValidTimes: (keyof TimeEntry)[] = [];
        
        for (const key of timeKeys) {
            const val = entry[key];
            if (typeof val === 'string') {
                const match = val.trim().match(validTimeRegex);
                if (match) {
                    const h = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    // Handle edge cases like "24:00" mapping to next day, etc. Standard is HH:MM.
                    validTimesFound.push({ timeStr: val.trim(), minutes: h * 60 + m });
                    originalKeysWithValidTimes.push(key);
                }
            }
        }
        
        // If there are less than 2 valid times, sorting them won't change anything meaningful
        if (validTimesFound.length < 2) {
            return entry;
        }
        
        // Sort chronologically based on minutes from midnight
        validTimesFound.sort((a, b) => a.minutes - b.minutes);
        
        // Ensure we assign them back ONLY into the keys that successfully held a valid time,
        // preserving the number of extracted times and their standard topological columns.
        const sortedEntry = { ...entry };
        
        for (let i = 0; i < validTimesFound.length; i++) {
            const destKey = originalKeysWithValidTimes[i];
            sortedEntry[destKey] = validTimesFound[i].timeStr;
        }
        
        return sortedEntry;
    });
};
