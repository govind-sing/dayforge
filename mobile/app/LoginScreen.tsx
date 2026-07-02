import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupMessage, setSignupMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setSignupMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      // AuthContext handles navigation automatically on success
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName.trim() || null } },
      })
      if (error) {
        setError(error.message)
      } else {
        setSignupMessage('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    }

    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>DF</Text>
          </View>
          <Text style={styles.brand}>DayForge</Text>
          <Text style={styles.tagline}>Focus. Build. Repeat.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Text>

          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.label}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Alex Rivera"
                placeholderTextColor="#a8a29e"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor="#a8a29e"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#a8a29e"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {signupMessage && <Text style={styles.success}>{signupMessage}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#f5f4f0" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setSignupMessage(null)
              setDisplayName('')
            }}
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchLink}>
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f4f0',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0f0e0c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#f5f4f0',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  brand: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f0e0c',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#a8a29e',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ebebе7',
    borderRadius: 24,
    padding: 28,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f0e0c',
    textAlign: 'center',
    marginBottom: 8,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#a8a29e',
  },
  input: {
    backgroundColor: '#f5f4f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f0e0c',
    borderWidth: 1,
    borderColor: '#e5e3df',
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  success: {
    color: '#10b981',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0f0e0c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '600',
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#a8a29e',
    marginTop: 4,
  },
  switchLink: {
    color: '#0f0e0c',
    fontWeight: '600',
  },
})
