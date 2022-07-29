export interface DeviceInfo extends Record<string, unknown> {
  mac: string;
  icon: string;
  name: string;
}

export enum DeviceMode {
  AUTO = 1,
  COOL = 2,
  HEAT = 3,
  FAN = 4,
  DRY = 5,
}

export type SpeedState = 0 | 2 | 3 | 4 | 5 | 6;

export enum TemperatureUnits {
  CELSIUS = 0,
  FAHRENHEIT = 1,
}

export interface DeviceData extends Record<string, unknown> {
  machineready: boolean;
  manufacturer: {
    _id: number;
    text: string;
  };
  power: boolean;
  aidooit: boolean;
  device_master_slave: boolean;
  emerheatpresent: boolean;
  emerheatstatus: boolean;
  fallback: boolean;
  master: boolean;
  real_mode: number;
  setpoint_step: boolean;
  t1t2on: boolean;
  tsensor_error: boolean;
  units: TemperatureUnits;
  work_temp_selec_sensor: number;
  slats_autoud: boolean;
  slats_swingud: true;
  slats_vnum: number;
  mode: DeviceMode;
  mode_available: Array<DeviceMode>;
  setpoint_air_cool: number;
  setpoint_air_heat: number;
  error_value: number;
  speed_available: Array<number>;
  speed_state: SpeedState;
  setpoint_air_auto: number;
  version: string;
  range_sp_cool_air_max: number;
  range_sp_cool_air_min: number;
  range_sp_hot_air_max: number;
  range_sp_hot_air_min: number;
  error_ascii1: string;
  error_ascii2: string;
  range_sp_auto_air_max: number;
  range_sp_auto_air_min: number;
  slats_vertical_1: number;
  work_temp: number;
  ext_temp: number;
  stat_channel: number;
  stat_rssi: number;
  stat_ssid: string;
  icon: string;
  name: string;
  timezoneId: string;
  isConnected: boolean;
}

export type InstallationInfo = {
  _id: string;
  name: string;
  devices: Array<DeviceInfo>;
  timezoneId: string;
  units: number;
  schedules: Array<unknown>;
  added_at: string;
  type: string;
};

export type DeviceDataMessage = {
  mac: string;
  data: DeviceData;
};

export type InstallationSummary = Pick<
  InstallationInfo,
  "_id" | "type" | "added_at"
>;

export type DknScope = {
  installations: Array<InstallationSummary>;
  language: string;
};

export type DknLoginData = {
  name: string;
  lastName: string;
  toc: boolean;
  commercial: boolean;
  support: boolean;
  commercial_date: string;
  support_date: string;
  email: string;
};

export type DknLogin = {
  _id: string;
  data: DknLoginData;
  scope: Record<string, DknScope>;
  created_at: string;
  confirmation_date: string;
  token: string;
  refreshToken: string;
};

export type DknToken = { token: string; refreshToken: string };

export type ApiConfig = {
  baseUrl: string;
  apiBase: string;
  loginPath: string;
  loggedInPath: string;
  refreshPath: string;
  installationsPath: string;
  socketPath: string;
  userAgent?: string;
};
