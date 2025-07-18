import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";

const CategoryModal = ({
  visible,
  onClose,
  products,
  onCategoryChange,
  newCategoryName,
  setNewCategoryName,
  onAddNewCategory,
}) => {
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Category</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Select Existing Category</Text>
          <ScrollView style={styles.categoryList}>
            {[...new Set(products.map((p) => p.category || "general"))].map(
              (category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryListItem}
                  onPress={() => onCategoryChange(category)}
                >
                  <Text style={styles.categoryListText}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>

          <Text style={styles.inputLabel}>Or Create New Category</Text>
          <View style={styles.newCategoryContainer}>
            <TextInput
              style={[styles.input, styles.newCategoryInput]}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Enter new category name..."
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.addCategoryButton}
              onPress={onAddNewCategory}
            >
              <Text style={styles.addCategoryButtonText}>Apply</Text>
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
  categoryList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  categoryListItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  categoryListText: {
    fontSize: 16,
    color: "#495057",
  },
  newCategoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  newCategoryInput: {
    flex: 1,
    marginBottom: 0,
  },
  addCategoryButton: {
    backgroundColor: "#212529",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addCategoryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
};

export default CategoryModal;
