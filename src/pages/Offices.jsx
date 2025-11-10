import React, { useState, useEffect } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";

const Offices = () => {
  const [offices, setOffices] = useState([]);
  const [newOffice, setNewOffice] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleteIndex, setDeleteIndex] = useState(null);

  // Load from localStorage or default
  useEffect(() => {
    const saved = localStorage.getItem("offices");
    if (saved && JSON.parse(saved).length > 0) {
      setOffices(JSON.parse(saved));
    } else {
      const defaults = [
        { name: "Registrar", id: "registrar" },
        { name: "Clinic", id: "clinic" },
        { name: "Admin Office", id: "admin_office" },
        { name: "CCIS Faculty", id: "ccis_faculty" },
        { name: "SDS Office", id: "sds_office" },
      ];
      setOffices(defaults);
      localStorage.setItem("offices", JSON.stringify(defaults));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("offices", JSON.stringify(offices));
  }, [offices]);

  const handleAdd = () => {
    if (!newOffice.trim()) {
      alert("Please enter an office name.");
      return;
    }
    const newOfficeObj = {
      name: newOffice,
      id: newOffice.toLowerCase().replace(/\s+/g, "_"),
    };
    setOffices([...offices, newOfficeObj]);
    setNewOffice("");
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditName(offices[index].name);
  };

  const handleSave = (index) => {
    const updated = [...offices];
    updated[index].name = editName;
    updated[index].id = editName.toLowerCase().replace(/\s+/g, "_");
    setOffices(updated);
    setEditingIndex(null);
    setEditName("");
  };

  const confirmDelete = () => {
    const updated = offices.filter((_, i) => i !== deleteIndex);
    setOffices(updated);
    setDeleteIndex(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border border-[#7400EA] rounded-xl shadow-sm p-4 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
        <h3 className="text-lg font-semibold mb-4">Office Accounts</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            placeholder="New office name"
            className="flex-1 px-4 py-2 border border-[#7400EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={newOffice}
            onChange={(e) => setNewOffice(e.target.value)}
          />
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 bg-[#7400EA] text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus size={18} /> Add Office
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offices.map((office, index) => (
          <div
            key={index}
            className="flex flex-col justify-between border border-[#7400EA] rounded-xl p-4 shadow-sm hover:shadow-md transition-all dark:bg-gray-900"
          >
            <div>
              {editingIndex === index ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-400 mb-2"
                />
              ) : (
                <>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{office.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    ID: {office.id}
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              {editingIndex === index ? (
                <button
                  onClick={() => handleSave(index)}
                  className="flex-1 bg-[#7400EA] text-white py-2 rounded-md hover:bg-[#4700E6] transition-all"
                >
                  💾 Save
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleEdit(index)}
                    className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200 transition-all"
                  >
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteIndex(index)}
                    className="flex-1 flex items-center justify-center gap-1 bg-red-100 text-red-600 py-2 rounded-md hover:bg-red-200 transition-all"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
            <h4 className="text-lg font-semibold mb-2">Are you sure?</h4>
            <p className="text-gray-600 mb-4">
              Do you really want to delete{" "}
              <strong>{offices[deleteIndex].name}</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                onClick={() => setDeleteIndex(null)}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                onClick={confirmDelete}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Offices;
