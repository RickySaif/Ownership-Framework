// AL-2: weekend days are charged as leave (R2).
import { demo, caption, evidence, as } from '../../../../lib/demo.mjs';

demo('AL-2 weekend days are counted as leave', async ({ page, db, track }) => {
  await caption('Requirement R2: only working days count. Friday 8 to Monday 11 March 2030 is 2 days.');
  await as(page, 'employee2');
  await caption('Cleo asks for Friday 8 March to Monday 11 March 2030: a long weekend.');
  await page.getByTestId('start').fill('2030-03-08');
  await page.getByTestId('end').fill('2030-03-11');
  await page.getByTestId('reason').fill('long weekend');
  await page.getByTestId('submit-request').click();
  const row = page.locator('[data-testid=my-requests] tbody tr').first();
  await row.getByText('pending').waitFor();
  const id = Number(await row.getAttribute('data-request-id'));
  track({ table: 'requests', id, cleanup: { via: 'reset' } });
  const stored = (await db.read(`SELECT days FROM requests WHERE id = ${id}`))[0];
  await caption(`The request says ${stored.days} days. Worked out by hand: Friday + Monday = 2.`);
  await evidence({
    title: 'Confirmed two ways',
    rows: {
      'expected (R2)': { value: '2 working days (Fri 8, Mon 11)', good: true },
      'shown in the list': { value: `${await row.locator('td').nth(2).textContent()} days`, bad: true },
      'stored days': { value: String(stored.days), bad: true },
      'why': 'Saturday 9 and Sunday 10 were counted',
    },
  });
  await caption('Once approved, Cleo would lose 4 days of leave for a 2-day absence.', { hold: 3500 });
});
