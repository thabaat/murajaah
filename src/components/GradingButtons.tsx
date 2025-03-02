import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Rating } from '../types';

interface GradingButtonsProps {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
  showIntervals?: boolean;
  intervals?: { [key in Rating]: number };
}

const GradingButtons: React.FC<GradingButtonsProps> = ({
  onRate,
  disabled = false,
  showIntervals = false,
  intervals = { 1: 0, 2: 1, 3: 3, 4: 7 },
}) => {
  const theme = useTheme();

  // Button configurations
  const buttons: { rating: Rating; label: string; color: string }[] = [
    { rating: 1, label: 'Again', color: theme.colors.error },
    { rating: 2, label: 'Hard', color: '#FF9800' }, // Orange
    { rating: 3, label: 'Good', color: theme.colors.primary },
    { rating: 4, label: 'Easy', color: '#4CAF50' }, // Green
  ];

  return (
    <View style={styles.container}>
      {buttons.map((button) => (
        <TouchableOpacity
          key={button.rating}
          style={[
            styles.button,
            {
              backgroundColor: disabled
                ? theme.colors.surfaceDisabled
                : button.color,
            },
            Platform.OS === 'ios' ? styles.iosButton : null,
          ]}
          onPress={() => onRate(button.rating)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{button.label}</Text>
          {showIntervals && (
            <Text style={styles.intervalText}>
              {intervals[button.rating] === 0
                ? 'Today'
                : intervals[button.rating] === 1
                ? 'Tomorrow'
                : `${intervals[button.rating]} days`}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  button: {
    flex: 1,
    margin: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  iosButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  intervalText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
});

export default GradingButtons;