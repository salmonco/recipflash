import { TextStyle } from 'react-native';

export const colors = {
  primary: '#FCD12C',
  background: '#FEF3DF',
  point: '#FDB29F',
  text: '#333333',
  white: '#FFFFFF',
  gray: '#A9A9A9',
};

type Typography = {
  title: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
};

export const typography: Typography = {
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.text,
  },
};
