//Hàm test cho file recipeRecommendService.js
const {
    normalizeIngredientIds,
    recommendRecipesByIngredientIds,
    RECIPE_RECOMMEND_QUERY,
} = require('../src/services/recipeRecommendService');

describe('recipeRecommendService', () => {
    describe('normalizeIngredientIds', () => {
        test('returns null for empty or non-array values', () => {
            expect(normalizeIngredientIds()).toBeNull();
            expect(normalizeIngredientIds([])).toBeNull();
            expect(normalizeIngredientIds('1,2')).toBeNull();
        });

        test('normalizes valid ids, filters invalid values, and deduplicates', () => {
            expect(normalizeIngredientIds([1, '2', 2, 0, -1, 'abc', 3])).toEqual([1, 2, 3]);
        });
    });

    describe('recommendRecipesByIngredientIds', () => {
        test('throws 400-style error when ingredient ids are invalid', async () => {
            const dbMock = { query: jest.fn() };

            await expect(recommendRecipesByIngredientIds(dbMock, [])).rejects.toMatchObject({
                statusCode: 400,
                message: 'Danh sách nguyên liệu không hợp lệ',
            });

            expect(dbMock.query).not.toHaveBeenCalled();
        });

        test('calls db.query with normalized ids and returns rows', async () => {
            const mockRows = [
                { recipe_id: 1, title: 'Trứng chiên hành', match_count: '2' },
                { recipe_id: 3, title: 'Mì xào trứng', match_count: '1' },
            ];

            const dbMock = {
                query: jest.fn().mockResolvedValue({ rows: mockRows }),
            };

            const rows = await recommendRecipesByIngredientIds(dbMock, ['1', 2, 2, '3']);

            expect(dbMock.query).toHaveBeenCalledTimes(1);
            expect(dbMock.query).toHaveBeenCalledWith(RECIPE_RECOMMEND_QUERY, [[1, 2, 3]]);
            expect(rows).toEqual(mockRows);
        });
    });
});
