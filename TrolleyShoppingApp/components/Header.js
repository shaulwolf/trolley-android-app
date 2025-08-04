import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";

const Header = ({
  title,
  onSync,
  onClearAll,
  onAddProduct,
  isSyncing,
  syncStatus,
  showSyncButton = true,
  showClearButton = true,
  showAddButton = true,
  onOpenBurgerMenu,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <TouchableOpacity
          onPress={onOpenBurgerMenu}
          style={styles.burgerButton}
        >
          <Ionicons name="menu" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.rightSection}>
        {showAddButton && (
          <TouchableOpacity onPress={onAddProduct} style={styles.button}>
            <Ionicons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  burgerButton: {
    padding: 5,
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    padding: 10,
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  spinning: {
    transform: [{ rotate: "360deg" }],
  },
});

export default Header;
