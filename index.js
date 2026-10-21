/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {initializeMonitoring} from './src/lib/monitoring';

initializeMonitoring();

AppRegistry.registerComponent(appName, () => App);
