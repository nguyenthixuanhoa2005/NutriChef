'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../errors/asyncHandler');
const { authenticateAccessToken } = require('../../middlewares/auth');
const {
    listUsers,
    getUserRecipes,
    createUser,
    updateUser,
    deleteUser,
} = require('../../controllers/admin/adminUserController');

router.get('/', authenticateAccessToken, asyncHandler(listUsers));
router.get('/:id/recipes', authenticateAccessToken, asyncHandler(getUserRecipes));
router.post('/', authenticateAccessToken, asyncHandler(createUser));
router.put('/:id', authenticateAccessToken, asyncHandler(updateUser));
router.delete('/:id', authenticateAccessToken, asyncHandler(deleteUser));

module.exports = router;
