import React, { useState, useEffect } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";

const Offices = () => {
  const [offices, setOffices] = useState([]);
  const [newOffice, setNewOffice] = useState("");
  const [inputEnabled, setInputEnabled] = useState(false); // <-- controls input
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleteIndex, setDeleteIndex] = useState(null);

  // Load offices from localStorage
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

  const handleAddClick = () => {
    if (!inputEnabled) {
      // Enable input first
      setInputEnabled(true);
      return;
    }

    // Add office if input enabled and has value
    if (!newOffice.trim()) return;
    const newOfficeObj = {
      name: newOffice,
      id: newOffice.toLowerCase().replace(/\s+/g, "_"),
    };
    setOffices([...offices, newOfficeObj]);
    setNewOffice("");
    setInputEnabled(false); // optionally reset input
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
      <div className="border border-[#7400EA] rounded-xl shadow-sm p-4 dark:bg-gray-900 dark:text-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h3 className="text-lg font-semibold">Office Accounts</h3>

          <div className="flex gap-2 w-full lg:w-auto">
            <input
              type="text"
              placeholder="New office name"
              disabled={!inputEnabled} // <-- controlled by state
              className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                inputEnabled
                  ? "border-[#7400EA] dark:border-indigo-400 text-black dark:text-white bg-white dark:bg-gray-800"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
              value={newOffice}
              onChange={(e) => setNewOffice(e.target.value)}
            />

            <button
              onClick={handleAddClick}
              className="flex items-center justify-center gap-2 bg-[#7400EA] text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm whitespace-nowrap"
            >
              <Plus size={18} /> {inputEnabled ? "Save Office" : "Add Office"}
            </button>
          </div>
        </div>
      </div>

      {/* Office List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offices.map((office, index) => (
          <div
            key={index}
            className="flex items-center justify-between border border-[#7400EA] rounded-xl p-4 shadow-sm hover:shadow-md transition-all dark:bg-gray-900"
          >
            <div className="flex-1">
              {editingIndex === index ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-400"
                />
              ) : (
                <>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {office.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {office.id}
                  </p>
                </>
              )}
            </div>

            {editingIndex === index ? (
              <button
                onClick={() => handleSave(index)}
                className="ml-3 bg-[#7400EA] text-white px-3 py-2 rounded-md text-sm hover:bg-[#4700E6]"
              >
                Save
              </button>
            ) : (
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(index)}
                  className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <Pencil size={16} /> Edit
                </button>

                <button
                  onClick={() => setDeleteIndex(index)}
                  className="flex items-center gap-1 bg-red-100 dark:bg-red-700 text-red-600 dark:text-white px-3 py-2 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-600"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-sm w-full text-center border dark:border-gray-700">
            <h4 className="text-lg font-semibold mb-2 dark:text-gray-100">
              Are you sure?
            </h4>
            <p className="text-gray-600 dark:text-gray-300 mb-5">
              Delete <strong>{offices[deleteIndex].name}</strong> permanently?
            </p>

            <div className="flex justify-center gap-3">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
                onClick={() => setDeleteIndex(null)}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
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
