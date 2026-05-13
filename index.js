/**
 * @format
 */

import './polyfills/stream-polyfill';
import { errorReporter } from './src/services/ErrorReporter';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

errorReporter.install();

AppRegistry.registerComponent(appName, () => App);
