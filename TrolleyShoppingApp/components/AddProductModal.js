import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";

const AddProductModal = ({
  visible,
  onClose,
  productUrl,
  setProductUrl,
  selectedCategory,
  setSelectedCategory,
  onAdd,
  isExtracting,
}) => {
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Product</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Product URL</Text>
          <TextInput
            style={[styles.input, styles.urlInput]}
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="Paste product link here..."
            placeholderTextColor="#999"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>Category (optional)</Text>
          <TextInput
            style={[styles.input, styles.categoryInput]}
            value={selectedCategory}
            onChangeText={setSelectedCategory}
            placeholder="Enter category or leave blank for 'general'"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isExtracting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.addProductButton,
                isExtracting && styles.disabledButton,
              ]}
              onPress={onAdd}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.addProductButtonText}>
                    {" "}
                    Extracting...
                  </Text>
                </>
              ) : (
                <Text style={styles.addProductButtonText}>Add to Trolley</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  modalCloseButton: {
    fontSize: 18,
    color: "#6c757d",
    fontWeight: "600",
    padding: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  urlInput: {
    color: "#212529",
  },
  categoryInput: {
    color: "#212529",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  cancelButtonText: {
    color: "#495057",
    fontSize: 16,
    fontWeight: "600",
  },
  addProductButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#212529",
    flexDirection: "row",
    justifyContent: "center",
  },
  addProductButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#6c757d",
  },
};

export default AddProductModal;
