<?php

include "_login.php";

$status     = "error";
$error      = 0;
$textstatus = "";

session_start();

$username = "";
$password = "";
if (array_key_exists("username",$_GET)) { $username = $_GET["username"]; }
if (array_key_exists("password",$_GET)) { $password = $_GET["password"]; }

login($username, $password, $status, $textstatus, $error);


// PUBLISH DATA UNDER JSON FORMAT
echo '{';
echo '  "status" : "'.$status.'",';
if ($error) { echo '  "error" : '.$error.','; }
echo '  "textStatus" : "'.$textstatus.'"';
echo '}';

?>

