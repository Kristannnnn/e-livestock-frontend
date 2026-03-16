import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Provider as PaperProvider,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import AgriButton from "../../components/AgriButton";
import AppHeader from "../../components/header";
import { agriPaperTheme, agriPalette } from "../../constants/agriTheme";

const API_URL =
  "https://e-livestock.tulongkabataanbicol.com/eLiveStockAPI/API/register.php";
const API_SEND_OTP =
  "https://e-livestock.tulongkabataanbicol.com/eLiveStockAPI/API/send_otp.php";

export default function Register() {
  return (
    <PaperProvider theme={agriPaperTheme}>
      <RegisterScreen />
    </PaperProvider>
  );
}

function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value) => value.includes("@");
  const isValidPhone = (value) => value.length === 11;

  const handleRegister = async () => {
    if (
      !firstname ||
      !lastname ||
      !address ||
      !email ||
      !phone ||
      !username ||
      !password
    ) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Invalid Email", "Email must contain @");
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert(
        "Invalid Phone Number",
        "Phone number must be exactly 11 digits."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname,
          lastname,
          address,
          email,
          phone,
          username,
          password,
        }),
      });

      const rawText = await response.text();
      const result = JSON.parse(rawText);

      if (!result.success) {
        Alert.alert("Error", result.message);
        setLoading(false);
        return;
      }

      const otpRes = await fetch(API_SEND_OTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "register" }),
      });

      const otpResult = await otpRes.json();

      if (!otpResult.success) {
        Alert.alert("Error", otpResult.message);
        setLoading(false);
        return;
      }

      Alert.alert("Success", "OTP sent to your email.");
      router.replace({
        pathname: "/verifyOtp",
        params: { email, purpose: "register" },
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Network or server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader />
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Register for livestock permit access with the same updated
            field-ready visual style.
          </Text>
          <View style={styles.formContainer}>
            <TextInput
              label="First Name"
              mode="outlined"
              value={firstname}
              onChangeText={setFirstname}
              style={styles.input}
            />
            <TextInput
              label="Last Name"
              mode="outlined"
              value={lastname}
              onChangeText={setLastname}
              style={styles.input}
            />
            <TextInput
              label="Address"
              mode="outlined"
              value={address}
              onChangeText={setAddress}
              style={styles.input}
            />
            <TextInput
              label="Email"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              label="Phone Number"
              mode="outlined"
              value={phone}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, "");
                if (numeric.length <= 11) {
                  setPhone(numeric);
                }
              }}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              label="Username"
              mode="outlined"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
            />
            <TextInput
              label="Password"
              mode="outlined"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <AgriButton
              title="Create account"
              subtitle="Request owner access and verification"
              icon="sprout"
              loading={loading}
              onPress={handleRegister}
              disabled={loading}
              style={styles.registerButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingTop: 140,
    paddingBottom: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: agriPalette.ink,
    marginBottom: 10,
  },
  subtitle: {
    width: "90%",
    maxWidth: 620,
    textAlign: "center",
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  formContainer: {
    width: "90%",
    maxWidth: 620,
    backgroundColor: agriPalette.surface,
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: agriPalette.border,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  input: {
    marginBottom: 12,
  },
  registerButton: {
    marginTop: 24,
  },
});
