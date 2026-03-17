import { Router } from 'express';

import { UiController } from './ui.controller';

const controller = new UiController();

export const uiRouter = Router();

uiRouter.get('/', controller.dashboard);
uiRouter.post('/products', controller.createProduct);
uiRouter.post('/stock', controller.adjustStock);
uiRouter.post('/orders', controller.placeOrder);
uiRouter.post('/orders/cancel', controller.cancelOrder);
