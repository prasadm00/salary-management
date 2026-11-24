import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors/appErrors.js';
import { FakeEmployeeQueryRepository } from '../../tests/fakeEmployeeQueryRepository.js';
import { employeeListQuerySchema } from './employeeList.schema.js';
import { EmployeeQueryService } from './employeeQuery.service.js';

const query = (params: Record<string, string> = {}) => employeeListQuerySchema.parse(params);

describe('EmployeeQueryService.list', () => {
  it('passes the query to the repository and wraps the result in the standard paged shape', async () => {
    const repository = new FakeEmployeeQueryRepository({ rows: [], total: 10000 });
    const service = new EmployeeQueryService(repository);

    const result = await service.list(query({ page: '3', pageSize: '50' }));

    expect(result).toEqual({ data: [], page: 3, pageSize: 50, total: 10000 });
    expect(repository.lastQuery).toMatchObject({ page: 3, pageSize: 50 });
  });

  it('reports the total of matching records, not the size of the page', async () => {
    const repository = new FakeEmployeeQueryRepository({ rows: [], total: 14 });

    const result = await new EmployeeQueryService(repository).list(query({ pageSize: '5' }));

    expect(result.total).toBe(14);
  });

  describe('R-32: salary sorting needs one currency or the USD view', () => {
    const expectedDetail = [
      {
        field: 'sortBy',
        message: 'Choose a currency or switch to the USD view to sort by salary.',
      },
    ];

    it('rejects a salary sort across currencies, and never queries the database', async () => {
      const repository = new FakeEmployeeQueryRepository();
      const service = new EmployeeQueryService(repository);

      const attempt = service.list(query({ sortBy: 'salary' }));

      await expect(attempt).rejects.toThrowError(ValidationError);
      await expect(attempt).rejects.toMatchObject({ details: expectedDetail });
      expect(repository.calls).toBe(0);
    });

    it('still rejects it when only a country filter is given, because a country is not a currency', async () => {
      const service = new EmployeeQueryService(new FakeEmployeeQueryRepository());

      await expect(service.list(query({ sortBy: 'salary', country: 'DE' }))).rejects.toMatchObject({
        details: expectedDetail,
      });
    });

    it('allows it when a currency is chosen', async () => {
      const repository = new FakeEmployeeQueryRepository();

      await new EmployeeQueryService(repository).list(query({ sortBy: 'salary', currency: 'INR' }));

      expect(repository.calls).toBe(1);
    });

    it('allows it in the USD view', async () => {
      const repository = new FakeEmployeeQueryRepository();

      await new EmployeeQueryService(repository).list(query({ sortBy: 'salary', view: 'usd' }));

      expect(repository.lastQuery).toMatchObject({ sortBy: 'salary', view: 'usd' });
    });

    it.each(['fullName', 'employeeCode', 'hireDate', 'department', 'country', 'level'])(
      'does not apply to sorting by %s',
      async (sortBy) => {
        const repository = new FakeEmployeeQueryRepository();

        await new EmployeeQueryService(repository).list(query({ sortBy }));

        expect(repository.calls).toBe(1);
      },
    );
  });
});
