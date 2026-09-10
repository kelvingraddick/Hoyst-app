import React from 'react';
import './src/design/styles/global.css';
import {HoystApp} from './src/app/HoystApp';

// Release builds do not load the opt-in developer gallery.
const DesignSystemDevHost = __DEV__
  ? require('./src/design/system/DesignSystemDevHost').DesignSystemDevHost
  : () => null;

export default function App() {
  return (
    <>
      <HoystApp />
      <DesignSystemDevHost />
    </>
  );
}
