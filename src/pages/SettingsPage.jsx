import { useState } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import { inputStyle } from "../lib/theme";

export default function SettingsPage({ school, setSchool, users, setUsers, toast }) {
  const [form, setForm] = useState({ ...school });
  const [newUser, setNewUser] = useState({ firstName: "", lastName: "", role: "teacher" });

  const saveSchool = () => {
    setSchool(form);
    toast("School info updated", "success");
  };

  const addUser = () => {
    if (!newUser.firstName || !newUser.lastName) return toast("Name required", "error");
    setUsers([...users, { ...newUser, id: Date.now() }]);
    setNewUser({ firstName: "", lastName: "", role: "teacher" });
    toast("User added", "success");
  };

  const removeUser = id => {
    if (!window.confirm("Remove this user?")) return;
    setUsers(users.filter(u => u.id !== id));
    toast("User removed", "success");
  };

  return (
    <div style={{ padding: 10 }}>
      <h2>School Info</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Name">
          <input
            style={inputStyle}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <input
            style={inputStyle}
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="Contact">
          <input
            style={inputStyle}
            value={form.contact}
            onChange={e => setForm({ ...form, contact: e.target.value })}
          />
        </Field>
        <Field label="Registration">
          <input
            style={inputStyle}
            value={form.registration}
            onChange={e => setForm({ ...form, registration: e.target.value })}
          />
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Btn onClick={saveSchool}>Save School</Btn>
      </div>
      <hr style={{ margin: "20px 0" }} />
      <h2>Users</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="First Name">
          <input
            style={inputStyle}
            value={newUser.firstName}
            onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
          />
        </Field>
        <Field label="Last Name">
          <input
            style={inputStyle}
            value={newUser.lastName}
            onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
          />
        </Field>
        <Field label="Role">
          <select
            style={inputStyle}
            value={newUser.role}
            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
          >
            <option value="admin">admin</option>
            <option value="teacher">teacher</option>
            <option value="staff">staff</option>
          </select>
        </Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <Btn onClick={addUser}>Add User</Btn>
      </div>
      <div style={{ marginTop: 20 }}>
        {users.length === 0 ? (
          <p>No users defined.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.firstName} {u.lastName}</td>
                    <td>{u.role}</td>
                    <td>
                      <Btn variant="danger" onClick={() => removeUser(u.id)}>Remove</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

SettingsPage.propTypes = {

  school: PropTypes.object.isRequired,
  setSchool: PropTypes.func.isRequired,
  users: PropTypes.array.isRequired,
  setUsers: PropTypes.func.isRequired,
  toast: PropTypes.func.isRequired,
};
