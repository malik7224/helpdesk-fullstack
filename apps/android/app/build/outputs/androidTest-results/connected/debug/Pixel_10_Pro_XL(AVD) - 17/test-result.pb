«
B
EndToEndTestdev.malik7224.helpdesksignInReadCommentAndCreateÔ
¶androidx.compose.ui.test.ComposeTimeoutException: Condition still not satisfied after 15000 ms
	at androidx.compose.ui.test.AndroidComposeUiTestEnvironment$AndroidComposeUiTestImpl.waitUntil(ComposeUiTest.android.kt:901)
	at androidx.compose.ui.test.junit4.AndroidComposeTestRule.waitUntil(AndroidComposeTestRule.android.kt:500)
	at dev.malik7224.helpdesk.EndToEndTest.waitForTag(EndToEndTest.kt:45)
	at dev.malik7224.helpdesk.EndToEndTest.waitForTag$default(EndToEndTest.kt:44)
	at dev.malik7224.helpdesk.EndToEndTest.signInReadCommentAndCreate(EndToEndTest.kt:74)
java.lang.RuntimeExceptionü	java.lang.RuntimeException: androidx.compose.ui.test.ComposeTimeoutException: Condition still not satisfied after 15000 ms
	at androidx.compose.ui.test.AndroidComposeUiTestEnvironment$AndroidComposeUiTestImpl.waitUntil(ComposeUiTest.android.kt:901)
	at androidx.compose.ui.test.junit4.AndroidComposeTestRule.waitUntil(AndroidComposeTestRule.android.kt:500)
	at dev.malik7224.helpdesk.EndToEndTest.waitForTag(EndToEndTest.kt:45)
	at dev.malik7224.helpdesk.EndToEndTest.waitForTag$default(EndToEndTest.kt:44)
	at dev.malik7224.helpdesk.EndToEndTest.signInReadCommentAndCreate(EndToEndTest.kt:74)

	at com.android.tools.androidtest.testengine.descriptor.AndroidDynamicTestDescriptor.execute(AndroidDynamicTestDescriptor.kt:77)
	at com.android.tools.androidtest.testengine.descriptor.AndroidDynamicTestDescriptor.execute(AndroidDynamicTestDescriptor.kt:38)
	at java.base/java.util.concurrent.ForkJoinTask.doExec(ForkJoinTask.java:507)
	at java.base/java.util.concurrent.ForkJoinPool$WorkQueue.topLevelExec(ForkJoinPool.java:1491)
	at java.base/java.util.concurrent.ForkJoinPool.scan(ForkJoinPool.java:2073)
	at java.base/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:2035)
	at java.base/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:187)
"‹

logcatandroidõ
ò/Users/malikali/Desktop/personal/vincentkipro/OnlineWork/helpdesk-fullstack/apps/android/app/build/outputs/androidTest-results/connected/debug/Pixel_10_Pro_XL(AVD) - 17/logcat-dev.malik7224.helpdesk.EndToEndTest-signInReadCommentAndCreate.txt*Õ

device-infoandroidº
·/Users/malikali/Desktop/personal/vincentkipro/OnlineWork/helpdesk-fullstack/apps/android/app/build/outputs/androidTest-results/connected/debug/Pixel_10_Pro_XL(AVD) - 17/device-info.pb