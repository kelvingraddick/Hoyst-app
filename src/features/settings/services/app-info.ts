import {NativeModules} from 'react-native';
export function getInstalledAppInfo(): {version?: string; build?: string} {
  const module = NativeModules.HoystAppInfo;
  const constants = module?.getConstants?.() ?? module;
  return {
    version:
      typeof constants?.version === 'string' ? constants.version : undefined,
    build: typeof constants?.build === 'string' ? constants.build : undefined,
  };
}
