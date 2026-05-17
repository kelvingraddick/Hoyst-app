export type CuratedTimezoneOption = {
  aliases?: string[];
  id: string;
  name: string;
};

export type TimezonePickerOption = {
  description: string;
  id: string;
  isDetected: boolean;
  label: string;
  searchText: string;
};

type TimezonePickerOptionsInput = {
  currentTimezone?: string;
  localTimezone: string;
  now?: Date;
};

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export const curatedTimezoneOptions: CuratedTimezoneOption[] = [
  {
    aliases: ['International Date Line West'],
    id: 'Etc/GMT+12',
    name: 'Baker Island Time',
  },
  {aliases: ['Samoa'], id: 'Pacific/Pago_Pago', name: 'Samoa Time'},
  {aliases: ['Hawaii'], id: 'Pacific/Honolulu', name: 'Hawaii Time'},
  {id: 'Pacific/Marquesas', name: 'Marquesas Time'},
  {aliases: ['Alaska'], id: 'America/Anchorage', name: 'Alaska Time'},
  {aliases: ['Pacific'], id: 'America/Los_Angeles', name: 'Pacific Time'},
  {aliases: ['Mountain'], id: 'America/Denver', name: 'Mountain Time'},
  {aliases: ['Central'], id: 'America/Chicago', name: 'Central Time'},
  {aliases: ['Eastern'], id: 'America/New_York', name: 'Eastern Time'},
  {aliases: ['Atlantic'], id: 'America/Halifax', name: 'Atlantic Time'},
  {
    aliases: ['Newfoundland'],
    id: 'America/St_Johns',
    name: 'Newfoundland Time',
  },
  {
    aliases: ['Brasilia', 'Brazil'],
    id: 'America/Sao_Paulo',
    name: 'Brasilia Time',
  },
  {id: 'Atlantic/South_Georgia', name: 'South Georgia Time'},
  {aliases: ['Azores'], id: 'Atlantic/Azores', name: 'Azores Time'},
  {aliases: ['GMT', 'Coordinated Universal Time'], id: 'UTC', name: 'UTC'},
  {aliases: ['British', 'GMT'], id: 'Europe/London', name: 'London Time'},
  {
    aliases: ['Central European'],
    id: 'Europe/Paris',
    name: 'Central European Time',
  },
  {
    aliases: ['Eastern European'],
    id: 'Europe/Athens',
    name: 'Eastern European Time',
  },
  {aliases: ['Moscow'], id: 'Europe/Moscow', name: 'Moscow Time'},
  {aliases: ['Iran'], id: 'Asia/Tehran', name: 'Iran Time'},
  {aliases: ['Gulf'], id: 'Asia/Dubai', name: 'Gulf Time'},
  {aliases: ['Afghanistan'], id: 'Asia/Kabul', name: 'Afghanistan Time'},
  {aliases: ['Pakistan'], id: 'Asia/Karachi', name: 'Pakistan Time'},
  {aliases: ['India'], id: 'Asia/Calcutta', name: 'India Time'},
  {aliases: ['Nepal'], id: 'Asia/Katmandu', name: 'Nepal Time'},
  {aliases: ['Bangladesh'], id: 'Asia/Dhaka', name: 'Bangladesh Time'},
  {aliases: ['Myanmar'], id: 'Asia/Rangoon', name: 'Myanmar Time'},
  {aliases: ['Indochina'], id: 'Asia/Bangkok', name: 'Indochina Time'},
  {
    aliases: ['China', 'Singapore', 'Hong Kong'],
    id: 'Asia/Shanghai',
    name: 'China Time',
  },
  {id: 'Australia/Eucla', name: 'Australian Central Western Time'},
  {aliases: ['Japan', 'Korea'], id: 'Asia/Tokyo', name: 'Japan Time'},
  {id: 'Australia/Darwin', name: 'Australian Central Time'},
  {
    aliases: ['Australian Eastern'],
    id: 'Australia/Sydney',
    name: 'Australian Eastern Time',
  },
  {id: 'Australia/Lord_Howe', name: 'Lord Howe Time'},
  {
    aliases: ['New Caledonia'],
    id: 'Pacific/Noumea',
    name: 'New Caledonia Time',
  },
  {aliases: ['New Zealand'], id: 'Pacific/Auckland', name: 'New Zealand Time'},
  {id: 'Pacific/Chatham', name: 'Chatham Time'},
  {id: 'Pacific/Tongatapu', name: 'Tonga Time'},
  {
    aliases: ['Line Islands'],
    id: 'Pacific/Kiritimati',
    name: 'Line Islands Time',
  },
];

function isValidTimezone(timezoneId: string) {
  try {
    Intl.DateTimeFormat(undefined, {timeZone: timezoneId}).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getTimezoneOffsetLabel(timezoneId: string, date = new Date()) {
  try {
    const timezoneName = Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezoneId,
      timeZoneName: 'longOffset',
    })
      .formatToParts(date)
      .find(part => part.type === 'timeZoneName')?.value;

    return timezoneName?.replace('GMT', 'UTC') ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function getFallbackTimezoneName(timezoneId: string) {
  if (timezoneId === 'UTC') {
    return 'UTC';
  }

  return (
    timezoneId
      .split('/')
      .at(-1)
      ?.replace(/_/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase()) ?? timezoneId
  );
}

export function getTimezonePickerOptions({
  currentTimezone,
  localTimezone,
  now = new Date(),
}: TimezonePickerOptionsInput): TimezonePickerOption[] {
  const optionsById = new Map<string, CuratedTimezoneOption>();

  curatedTimezoneOptions.forEach(option => {
    optionsById.set(option.id, option);
  });

  [localTimezone, currentTimezone?.trim(), 'UTC']
    .filter((timezoneId): timezoneId is string => Boolean(timezoneId))
    .forEach(timezoneId => {
      if (!optionsById.has(timezoneId)) {
        optionsById.set(timezoneId, {
          aliases: ['Current timezone'],
          id: timezoneId,
          name: getFallbackTimezoneName(timezoneId),
        });
      }
    });

  return Array.from(optionsById.values())
    .filter(option => isValidTimezone(option.id))
    .map(option => {
      const isDetected = option.id === localTimezone;
      const offset = getTimezoneOffsetLabel(option.id, now);
      const label = `${option.name} (${offset})`;
      const description = isDetected ? 'Detected device timezone' : option.id;
      const aliases = option.aliases?.join(' ') ?? '';

      return {
        description,
        id: option.id,
        isDetected,
        label,
        searchText:
          `${option.id} ${label} ${description} ${aliases}`.toLowerCase(),
      };
    });
}

export function filterTimezonePickerOptions(
  options: TimezonePickerOption[],
  search: string,
) {
  const searchTerm = search.trim().toLowerCase();

  if (!searchTerm) {
    return options;
  }

  return options.filter(option => option.searchText.includes(searchTerm));
}
