import PropTypes from "prop-types";
import UiTable from "./ui/Table";

export default function Table({ headers, rows, data, ...rest }) {
  return <UiTable headers={headers} data={rows || data} {...rest} />;
}

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.node).isRequired,
  rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.node)),
};
