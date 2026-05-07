import PropTypes from "prop-types";
import UiTable from "./ui/Table";

export default function Table({ headers, rows }) {
  return <UiTable headers={headers} data={rows} />;
}

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.string).isRequired,
  rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.node)).isRequired,
};
