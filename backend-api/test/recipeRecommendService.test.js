//Hàm test cho file recipeRecommendService.js
const {
    normalizeIngredientIds,
    recommendRecipesByIngredientIds,
    RECIPE_RECOMMEND_QUERY,
} = require('../src/services/recipeRecommendService');
const { createRecipeRecommendHandler } = require('../src/controllers/recipeRecommendController');

//Chuẩn hóa nguyên liệu input đầu vào 
describe('recipeRecommendService', () => {
    //đây là nhóm test case về hàm normalizeIngredientIds, nó sẽ kiểm tra xem hàm có trả về null khi đầu vào là rỗng hoặc không phải là mảng hay không, và kiểm tra xem hàm có trả về mảng đã được chuẩn hóa, lọc bỏ giá trị không hợp lệ và loại bỏ trùng lặp hay không.
    describe('normalizeIngredientIds', () => {

        //Test input
        test('Trả về null khi đầu vào là rỗng hoặc không phải là mảng', () => {
            expect(normalizeIngredientIds()).toBeNull();
            expect(normalizeIngredientIds([])).toBeNull();
            expect(normalizeIngredientIds('1,2')).toBeNull();
        });
        //Test chuẩn hóa 
        test('Chuẩn hóa các id hợp lệ, lọc bỏ giá trị không hợp lệ và loại bỏ trùng lặp', () => {
            expect(normalizeIngredientIds([1, '2', 2, 0, -1, 'abc', 3])).toEqual([1, 2, 3]);
        });

        test('Trả về null khi toàn bộ giá trị không hợp lệ', () => {
            expect(normalizeIngredientIds([null, undefined, '', 'abc', 0, -3, 2.5, NaN, {}])).toBeNull();
        });

        test('Giữ lại số nguyên dương và bỏ số thực/chuỗi rỗng', () => {
            expect(normalizeIngredientIds(['01', ' 2 ', '3.1', 4.2, '0', ''])).toEqual([1, 2]);
        });

        test('Loại bỏ trùng lặp sau khi ép kiểu number', () => {
            expect(normalizeIngredientIds(['5', 5, '05', 5])).toEqual([5]);
        });
    });

    //nhóm gợi ý theo nguyên liệu
    describe('recommendRecipesByIngredientIds', () => {
        //Test lỗi 400 khi danh sách nguyên liệu không hợp lệ
        test('Lỗi 400 khi danh sách nguyên liệu không hợp lệ', async () => {
            const dbMock = { query: jest.fn() };

            await expect(recommendRecipesByIngredientIds(dbMock, [])).rejects.toMatchObject({
                statusCode: 400,
                message: 'Danh sách nguyên liệu không hợp lệ',
            });

            expect(dbMock.query).not.toHaveBeenCalled();  //input sai sẽ ko được gọi đến db.query
        });

        //Test gọi db.query với các id đã được chuẩn hóa và trả về các hàng kết quả
        test('Gọi db.query với các id đã được chuẩn hóa và trả về các hàng kết quả', async () => {
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

        test('Trả về mảng rỗng khi db không tìm thấy công thức phù hợp', async () => {
            const dbMock = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
            };

            const rows = await recommendRecipesByIngredientIds(dbMock, [1, 2]);

            expect(dbMock.query).toHaveBeenCalledTimes(1);
            expect(dbMock.query).toHaveBeenCalledWith(RECIPE_RECOMMEND_QUERY, [[1, 2]]);
            expect(rows).toEqual([]);
        });

        test('Ném lại lỗi khi db.query thất bại', async () => {
            const dbError = new Error('database unavailable');
            const dbMock = {
                query: jest.fn().mockRejectedValue(dbError),
            };

            await expect(recommendRecipesByIngredientIds(dbMock, [1, 2])).rejects.toThrow('database unavailable');
            expect(dbMock.query).toHaveBeenCalledTimes(1);
        });
    });

    //Nhóm handler api gợi ý xem nó trả về kết quả đúng ko và xử lý lỗi đúng ko
    describe('createRecipeRecommendHandler', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        const createResMock = () => {
            const res = {
                status: jest.fn(),
                json: jest.fn(),
            };

            res.status.mockReturnValue(res);
            return res;
        };

        test('Trả về success + total_found + recipes khi recommend thành công', async () => {
            const dbMock = {};
            const recommendFn = jest.fn().mockResolvedValue([
                { recipe_id: 1, title: 'Trứng chiên hành' },
                { recipe_id: 2, title: 'Mì xào trứng' },
            ]);

            const handler = createRecipeRecommendHandler(dbMock, recommendFn);
            const req = { body: { ingredient_ids: [1, 2] } };
            const res = createResMock();

            await handler(req, res);

            expect(recommendFn).toHaveBeenCalledWith(dbMock, [1, 2]);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                total_found: 2,
                recipes: [
                    { recipe_id: 1, title: 'Trứng chiên hành' },
                    { recipe_id: 2, title: 'Mì xào trứng' },
                ],
            });
        });

        test('Trả về success với total_found=0 khi không có kết quả', async () => {
            const dbMock = {};
            const recommendFn = jest.fn().mockResolvedValue([]);

            const handler = createRecipeRecommendHandler(dbMock, recommendFn);
            const req = { body: { ingredient_ids: [99] } };
            const res = createResMock();

            await handler(req, res);

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                total_found: 0,
                recipes: [],
            });
        });

        test('Trả về 400 khi service ném lỗi validate input', async () => {
            const dbMock = {};
            const badRequestError = new Error('Danh sách nguyên liệu không hợp lệ');
            badRequestError.statusCode = 400;

            const recommendFn = jest.fn().mockRejectedValue(badRequestError);
            const handler = createRecipeRecommendHandler(dbMock, recommendFn);
            const req = { body: { ingredient_ids: [] } };
            const res = createResMock();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Danh sách nguyên liệu không hợp lệ' });
        });

        test('Trả về 500 khi service ném lỗi không mong muốn', async () => {
            const dbMock = {};
            const recommendFn = jest.fn().mockRejectedValue(new Error('db timeout'));

            const handler = createRecipeRecommendHandler(dbMock, recommendFn);
            const req = { body: { ingredient_ids: [1, 2] } };
            const res = createResMock();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Lỗi truy vấn món ăn' });
        });
    });
});
