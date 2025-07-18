import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { formatSyncTime } from "../utils/helpers";

const Header = ({
  title,
  onAddPress,
  isSyncing,
  syncStatus,
  lastSyncTime,
  onManualSync,
}) => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.syncStatus}>
        {isSyncing && (
          <View style={styles.syncIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.syncText}>Syncing...</Text>
          </View>
        )}

        {!isSyncing && syncStatus === "success" && lastSyncTime && (
          <TouchableOpacity onPress={onManualSync} style={styles.syncButton}>
            <Text style={styles.syncText}>
              ✅ Synced {formatSyncTime(lastSyncTime)}
            </Text>
          </TouchableOpacity>
        )}

        {!isSyncing && syncStatus === "error" && (
          <TouchableOpacity onPress={onManualSync} style={styles.syncButton}>
            <Text style={[styles.syncText, { color: "#FF3B30" }]}>
              ❌ Sync Failed - Tap to Retry
            </Text>
          </TouchableOpacity>
        )}

        {!isSyncing && syncStatus === "ready" && (
          <TouchableOpacity onPress={onManualSync} style={styles.syncButton}>
            <Text style={styles.syncText}>🔄 Tap to Sync</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.headerButtons}>
        <TouchableOpacity style={styles.addButton} onPress={onAddPress}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = {
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#212529",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#212529",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 20,
  },
  syncStatus: {
    alignItems: "center",
    marginVertical: 5,
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
  },
  syncText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
  },
};

export default Header;
