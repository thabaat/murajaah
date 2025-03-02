import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Image } from 'react-native';
import { Text, Button, useTheme, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../contexts/ThemeContext';
import KnownSurahsScreen from './known-surahs';
import StudyTimeScreen from './study-time';
import DownloadScreen from './download';
import ScriptSelectionScreen from './script-selection';

enum OnboardingStep {
  Welcome = 0,
  ScriptSelection = 1,
  KnownSurahs = 2,
  StudyTime = 3,
  Download = 4,
  Complete = 5,
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { isDarkMode } = useAppTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.Welcome);
  const [progress, setProgress] = useState(0.2);

  // Complete onboarding
  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('has_onboarded', 'true');
      router.replace('/');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  // Skip onboarding
  const skipOnboarding = async () => {
    try {
      await AsyncStorage.setItem('has_onboarded', 'true');
      router.replace('/');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  // Go to the next step
  const nextStep = () => {
    const nextStepValue = currentStep + 1;
    setCurrentStep(nextStepValue);
    
    // Update progress
    const progressValue = (nextStepValue + 1) / (Object.keys(OnboardingStep).length / 2);
    setProgress(Math.min(progressValue, 1));
    
    // If we've reached the end, complete onboarding
    if (nextStepValue === OnboardingStep.Complete) {
      completeOnboarding();
    }
  };

  // Go to the previous step
  const prevStep = () => {
    if (currentStep > 0) {
      const prevStepValue = currentStep - 1;
      setCurrentStep(prevStepValue);
      
      // Update progress
      const progressValue = (prevStepValue + 1) / (Object.keys(OnboardingStep).length / 2);
      setProgress(Math.max(progressValue, 0.2));
    }
  };

  // Render the current step
  const renderStep = () => {
    switch (currentStep) {
      case OnboardingStep.Welcome:
        return (
          <WelcomeStep onNext={nextStep} onSkip={skipOnboarding} />
        );
      case OnboardingStep.ScriptSelection:
        return (
          <ScriptSelectionScreen onNext={nextStep} onBack={prevStep} />
        );
      case OnboardingStep.KnownSurahs:
        return (
          <KnownSurahsScreen onNext={nextStep} onBack={prevStep} />
        );
      case OnboardingStep.StudyTime:
        return (
          <StudyTimeScreen onNext={nextStep} onBack={prevStep} />
        );
      case OnboardingStep.Download:
        return (
          <DownloadScreen onNext={nextStep} onBack={prevStep} />
        );
      default:
        return <WelcomeStep onNext={nextStep} onSkip={skipOnboarding} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ color: theme.colors.onBackground }}>
          Welcome to Muraja'ah
        </Text>
      </View>
      
      <ProgressBar progress={progress} color={theme.colors.primary} style={styles.progressBar} />
      
      <View style={styles.content}>
        {renderStep()}
      </View>
    </SafeAreaView>
  );
}

interface StepProps {
  onNext: () => void;
  onSkip: () => void;
}

const WelcomeStep: React.FC<StepProps> = ({ onNext, onSkip }) => {
  const theme = useTheme();
  
  return (
    <View style={styles.stepContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>
          The Quran Memorization App
        </Text>
        
        <Text variant="bodyLarge" style={styles.description}>
          Muraja'ah helps you memorize and retain the Quran using scientific spaced
          repetition techniques, optimizing your memory and making memorization more
          efficient.
        </Text>
        
        <Text variant="bodyMedium" style={styles.bulletPoint}>
          • Learn and review ayahs at the optimal time
        </Text>
        <Text variant="bodyMedium" style={styles.bulletPoint}>
          • Track your progress with detailed statistics
        </Text>
        <Text variant="bodyMedium" style={styles.bulletPoint}>
          • Memorize at your own pace with customizable settings
        </Text>
        <Text variant="bodyMedium" style={styles.bulletPoint}>
          • Works completely offline once set up
        </Text>
      </ScrollView>
      
      <View style={styles.buttonsContainer}>
        <Button mode="outlined" onPress={onSkip} style={styles.button}>
          Skip
        </Button>
        <Button mode="contained" onPress={onNext} style={styles.button}>
          Get Started
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  progressBar: {
    marginHorizontal: 16,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  bulletPoint: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingLeft: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
});