import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthProvider, useAuth } from './context/AuthContext'
import { View, ActivityIndicator } from 'react-native'

// Screens (we'll create these next)
import LoginScreen from './app/LoginScreen'
import DashboardScreen from './app/DashboardScreen'

const Stack = createNativeStackNavigator()

function RootNavigator() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f4f0' }}>
        <ActivityIndicator color="#0f0e0c" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator>
      </RootNavigator>
    </AuthProvider>
  )
}