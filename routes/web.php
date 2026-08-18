<?php

use App\Core\Router;

$router->get('/', ['DashboardController', 'index']);
$router->get('/login', ['AuthController', 'showLogin']);
$router->post('/login', ['AuthController', 'login']);
$router->get('/logout', ['AuthController', 'logout']);

$router->get('/pointage', ['PointageController', 'index']);
$router->post('/pointage/pointer', ['PointageController', 'pointer']);
$router->post('/pointage/scan', ['BiometricController', 'scan']);

$router->get('/users', ['UserController', 'index']);
$router->post('/users', ['UserController', 'store']);
$router->get('/users/delete/{id}', ['UserController', 'destroy']);
$router->get('/users/{id}/empreinte', ['UserController', 'enrollForm']);
$router->post('/users/{id}/empreinte', ['UserController', 'storeEnroll']);
$router->post('/users/{id}/empreinte/delete', ['UserController', 'deleteEnroll']);