export default function Hours({ hours }) {
  return (
    <table className="hours">
      <tbody>
        {hours.map((h) => (
          <tr key={h.name} className={h.open ? '' : 'is-closed'}>
            <th scope="row">{h.name}</th>
            <td>
              {h.hours}
              {h.note && (
                <>
                  {' '}
                  <span className="hours-note">{h.note}</span>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
