/**
 * Formats a 24-hour time string (e.g., "22:15", "09:30", "14:00") or Date/ISO string
 * into a clean 12-hour format with AM/PM (e.g., "10:15 PM", "9:30 AM", "2:00 PM").
 */
export const formatTimeTo12Hour = (timeStr?: string): string => {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';

  // If already contains AM or PM (case-insensitive), return trimmed as is
  if (/am|pm/i.test(trimmed)) {
    return trimmed;
  }

  // Handle "HH:mm" or "HH:mm:ss"
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');

    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }
  }

  return trimmed;
};

/**
 * Formats a start and end time window in 12-hour AM/PM format.
 * Example: formatTimeWindow("22:15", "23:00") -> "10:15 PM – 11:00 PM"
 */
export const formatTimeWindow = (startTime?: string, endTime?: string): string => {
  const startFormatted = formatTimeTo12Hour(startTime);
  const endFormatted = formatTimeTo12Hour(endTime);

  if (startFormatted && endFormatted) {
    return `${startFormatted} – ${endFormatted}`;
  }
  if (startFormatted) {
    return `Starts at ${startFormatted}`;
  }
  if (endFormatted) {
    return `Ends at ${endFormatted}`;
  }
  return 'Immediate / Active Schedule';
};

/**
 * Formats a Date object, ISO string, 'YYYY-MM-DD' string, or timestamp (in ms or seconds)
 * into strict DD/MM/YYYY format (e.g., "13/08/2026", "05/01/2026").
 */
export const formatDateToDDMMYYYY = (dateInput?: any): string => {
  if (!dateInput) return 'N/A';

  try {
    let d: Date | null = null;

    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'number') {
      d = new Date(dateInput > 1e11 ? dateInput : dateInput * 1000);
    } else if (typeof dateInput === 'object' && dateInput?.seconds !== undefined) {
      d = new Date(dateInput.seconds * 1000);
    } else if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return 'N/A';

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        return trimmed;
      }

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const parts = trimmed.split('T')[0].split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const month = parts[1];
          const day = parts[2];
          return `${day}/${month}/${year}`;
        }
      }

      d = new Date(trimmed);
    }

    if (!d || isNaN(d.getTime())) {
      return 'N/A';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (err) {
    return 'N/A';
  }
};
