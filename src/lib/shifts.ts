/**
 * Logic for Raza Gas Shift Validation
 * Day: 9:00 AM - 9:00 PM (21:00)
 * Night: 9:00 PM (21:00) - 9:00 AM
 */

export function isShiftTime(shift: string): boolean {
    if (!shift || shift === 'Any') return true;

    const now = new Date();
    const hour = now.getHours();

    // DAY SHIFT: 09:00 to 21:00
    if (shift === 'Day') {
        return hour >= 9 && hour < 21;
    }

    // NIGHT SHIFT: 21:00 to 09:00 (Midnight Crossing)
    if (shift === 'Night') {
        // Active if >= 21:00 OR < 09:00
        return hour >= 21 || hour < 9;
    }

    return true; // Default fallthrough
}

export function canBypassShift(role: string): boolean {
    const bypassRoles = ['admin', 'manager', 'cashier', 'owner']; // Lowercase check
    return bypassRoles.includes(role?.toLowerCase());
}
